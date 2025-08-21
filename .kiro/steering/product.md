# Product Overview

N8N-Work is a next-generation workflow automation platform designed for enterprise-scale deployment. It provides advanced workflow orchestration capabilities with a focus on security, scalability, and developer experience.

## Core Value Proposition

- **Ultra Scale**: Active/active multi-region deployment, zero-downtime updates, adaptive backpressure, and elastic autoscaling
- **Safety & Isolation**: Tiered sandboxing (VM2 → process → microVM → WASM), strict egress allowlists, plugin code signing, and policy engine
- **Enterprise Governance**: RBAC/ABAC, PII controls, data lineage, audit immutability, usage metering & billing
- **Developer Velocity**: Single source of truth contracts, codegen, local E2E testing, golden paths for nodes, fast CI with hermetic tests
- **Observability-First**: Distributed tracing across all components, click-to-correlation, SLOs with auto rollback

## Target Users

- **Enterprise DevOps Teams**: Need reliable, scalable workflow automation with security and compliance
- **Integration Developers**: Building custom nodes and integrations using the Node SDK
- **Platform Engineers**: Managing multi-tenant deployments with governance and monitoring
- **Business Users**: Creating and managing workflows through the web interface

## Key Differentiators

- Multi-level security isolation for untrusted code execution
- Built-in multi-tenancy with resource quotas and billing
- Comprehensive observability with distributed tracing
- Plugin marketplace with cryptographic signing
- Enterprise-grade compliance and audit capabilities