---
last_reviewed: 2026-09-11
---

# Azure storage and data

Use when selecting or troubleshooting storage/database services.

## Azure Storage

Understand the major storage models:

- Blob Storage: object storage.
- Azure Files: managed file shares.
- Queue Storage: simple storage-backed queues.
- Table Storage: key/attribute NoSQL storage.
- Managed Disks: block storage for Azure VMs.

Storage accounts have redundancy, performance, networking, security, and lifecycle settings that materially affect architecture and cost.

Official docs: https://learn.microsoft.com/azure/storage/

## Relational databases

### Azure SQL Database

Managed SQL Server-compatible relational database platform. Use when relational semantics and SQL Server ecosystem fit the workload.

Docs: https://learn.microsoft.com/azure/azure-sql/

### Azure Database for PostgreSQL

Managed PostgreSQL service for workloads that fit the PostgreSQL ecosystem.

Docs: https://learn.microsoft.com/azure/postgresql/

## Cosmos DB

Distributed NoSQL database service with multiple APIs/models. Choose it based on access patterns, global distribution, latency, scale, and consistency requirements—not simply because it is cloud-native.

Docs: https://learn.microsoft.com/azure/cosmos-db/

## Service-selection questions

Ask:

- Relational or non-relational model?
- Transaction/consistency requirements?
- Query/access patterns?
- Throughput and latency profile?
- Geographic distribution?
- Backup/recovery requirements?
- Private connectivity/security requirements?
- Operational skill and cost sensitivity?
