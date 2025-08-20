#!/bin/bash

# Code generation script for Protocol Buffers
# Generates Go and TypeScript code from .proto files

set -e

echo "Starting protocol buffer code generation..."

# Create output directories
mkdir -p ../engine-go/proto/orchestrator
mkdir -p ../engine-go/proto/engine
mkdir -p ../engine-go/proto/node_runner

mkdir -p ../orchestrator-nest/src/proto/orchestrator
mkdir -p ../orchestrator-nest/src/proto/engine
mkdir -p ../orchestrator-nest/src/proto/node_runner

mkdir -p ../node-runner-js/src/proto/orchestrator
mkdir -p ../node-runner-js/src/proto/engine  
mkdir -p ../node-runner-js/src/proto/node_runner

mkdir -p ../node-sdk-js/src/proto/orchestrator
mkdir -p ../node-sdk-js/src/proto/engine
mkdir -p ../node-sdk-js/src/proto/node_runner

echo "Generating Go code..."

# Generate Go code
protoc --go_out=../engine-go/proto --go_opt=paths=source_relative \
       --go-grpc_out=../engine-go/proto --go-grpc_opt=paths=source_relative \
       orchestrator.proto

protoc --go_out=../engine-go/proto --go_opt=paths=source_relative \
       --go-grpc_out=../engine-go/proto --go-grpc_opt=paths=source_relative \
       engine.proto

protoc --go_out=../engine-go/proto --go_opt=paths=source_relative \
       --go-grpc_out=../engine-go/proto --go-grpc_opt=paths=source_relative \
       node_runner.proto

echo "Generating TypeScript code for orchestrator-nest..."

# Generate TypeScript code for orchestrator-nest
protoc --plugin=protoc-gen-ts=../orchestrator-nest/node_modules/.bin/protoc-gen-ts \
       --ts_out=../orchestrator-nest/src/proto \
       --js_out=import_style=commonjs,binary:../orchestrator-nest/src/proto \
       orchestrator.proto engine.proto node_runner.proto

echo "Generating TypeScript code for node-runner-js..."

# Generate TypeScript code for node-runner-js  
protoc --plugin=protoc-gen-ts=../node-runner-js/node_modules/.bin/protoc-gen-ts \
       --ts_out=../node-runner-js/src/proto \
       --js_out=import_style=commonjs,binary:../node-runner-js/src/proto \
       orchestrator.proto engine.proto node_runner.proto

echo "Generating TypeScript code for node-sdk-js..."

# Generate TypeScript code for node-sdk-js
protoc --plugin=protoc-gen-ts=../node-sdk-js/node_modules/.bin/protoc-gen-ts \
       --ts_out=../node-sdk-js/src/proto \
       --js_out=import_style=commonjs,binary:../node-sdk-js/src/proto \
       orchestrator.proto engine.proto node_runner.proto

echo "Protocol buffer code generation completed successfully!"
