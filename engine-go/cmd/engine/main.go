package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/n8n-work/engine-go/internal/config"
	"github.com/n8n-work/engine-go/internal/exec"
	"github.com/n8n-work/engine-go/internal/observability"
	"github.com/n8n-work/engine-go/internal/repo"
	"github.com/n8n-work/engine-go/internal/invoker"
	executionv1 "github.com/n8n-work/engine-go/proto/executionv1"
	healthv1 "github.com/n8n-work/engine-go/proto/healthv1"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

const (
	serviceName    = "n8n-work-engine"
	serviceVersion = "0.1.0"
)

type Server struct {
	logger         *zap.Logger
	config         *config.Config
	grpcServer     *grpc.Server
	httpServer     *http.Server
	executionSvc   *exec.Service
	healthSvc      *exec.HealthService
	invokerSvc     *invoker.Service
	repo           *repo.Repository
}

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	logger.Info("Starting N8N-Work Engine",
		zap.String("service", serviceName),
		zap.String("version", serviceVersion))

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("Failed to load configuration", zap.Error(err))
	}

	// Initialize OpenTelemetry
	shutdown, err := observability.InitTracing(serviceName, serviceVersion, cfg.Observability.OTLPEndpoint)
	if err != nil {
		logger.Fatal("Failed to initialize tracing", zap.Error(err))
	}
	defer shutdown()

	// Initialize metrics
	metrics := observability.NewMetrics()

	// Initialize repository
	repository, err := repo.New(cfg.Database.URL, logger)
	if err != nil {
		logger.Fatal("Failed to initialize repository", zap.Error(err))
	}
	defer repository.Close()

	// Initialize services
	executionService := exec.NewService(logger, cfg, repository, metrics)
	healthService := exec.NewHealthService(logger, repository)
	invokerService := invoker.NewService(logger, cfg, repository, metrics)

	// Create server
	server := &Server{
		logger:       logger,
		config:       cfg,
		executionSvc: executionService,
		healthSvc:    healthService,
		invokerSvc:   invokerService,
		repo:         repository,
	}

	// Start server
	if err := server.Start(); err != nil {
		logger.Fatal("Server failed to start", zap.Error(err))
	}
}

func (s *Server) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var wg sync.WaitGroup

	// Start gRPC server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := s.startGRPCServer(ctx); err != nil {
			s.logger.Error("gRPC server failed", zap.Error(err))
		}
	}()

	// Start HTTP metrics server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := s.startHTTPServer(ctx); err != nil {
			s.logger.Error("HTTP server failed", zap.Error(err))
		}
	}()

	// Start message queue consumer
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := s.invokerSvc.Start(ctx); err != nil {
			s.logger.Error("Message queue consumer failed", zap.Error(err))
		}
	}()

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	s.logger.Info("Shutdown signal received, gracefully stopping...")

	// Graceful shutdown
	cancel()
	
	// Give services time to shut down
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		s.logger.Info("Server shutdown complete")
	case <-time.After(30 * time.Second):
		s.logger.Warn("Shutdown timeout exceeded, forcing exit")
	}

	return nil
}

func (s *Server) startGRPCServer(ctx context.Context) error {
	addr := s.config.GRPC.Address
	s.logger.Info("Starting gRPC server", zap.String("address", addr))

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}

	// Create gRPC server with OpenTelemetry instrumentation
	s.grpcServer = grpc.NewServer(
		grpc.UnaryInterceptor(otelgrpc.UnaryServerInterceptor()),
		grpc.StreamInterceptor(otelgrpc.StreamServerInterceptor()),
	)

	// Register services
	executionv1.RegisterExecutionServiceServer(s.grpcServer, s.executionSvc)
	healthv1.RegisterHealthServiceServer(s.grpcServer, s.healthSvc)
	grpc_health_v1.RegisterHealthServer(s.grpcServer, s.healthSvc)

	// Enable reflection for development
	if s.config.App.Environment == "development" {
		reflection.Register(s.grpcServer)
	}

	// Start serving in a goroutine
	errChan := make(chan error, 1)
	go func() {
		if err := s.grpcServer.Serve(lis); err != nil {
			errChan <- err
		}
	}()

	// Wait for context cancellation or error
	select {
	case <-ctx.Done():
		s.logger.Info("Shutting down gRPC server...")
		s.grpcServer.GracefulStop()
		return nil
	case err := <-errChan:
		return fmt.Errorf("gRPC server error: %w", err)
	}
}

func (s *Server) startHTTPServer(ctx context.Context) error {
	addr := s.config.HTTP.Address
	s.logger.Info("Starting HTTP server", zap.String("address", addr))

	mux := http.NewServeMux()

	// Prometheus metrics endpoint
	mux.Handle("/metrics", promhttp.Handler())

	// Health check endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","service":"%s","version":"%s","timestamp":"%s"}`,
			serviceName, serviceVersion, time.Now().UTC().Format(time.RFC3339))
	})

	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	// Start serving in a goroutine
	errChan := make(chan error, 1)
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- err
		}
	}()

	// Wait for context cancellation or error
	select {
	case <-ctx.Done():
		s.logger.Info("Shutting down HTTP server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return s.httpServer.Shutdown(shutdownCtx)
	case err := <-errChan:
		return fmt.Errorf("HTTP server error: %w", err)
	}
}
