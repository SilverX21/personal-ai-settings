---
last_reviewed: 2026-09-11
---

# AWS storage and data

Use for selecting storage/database services.

## S3

Object storage and one of AWS's foundational services.

Understand:

- Buckets and objects.
- Storage classes.
- Versioning.
- Lifecycle policies.
- Encryption.
- Bucket policies / access control.
- Event notifications.
- Replication where required.

Do not model S3 like a block/file-system disk unless the application abstraction genuinely supports object semantics.

Docs: https://docs.aws.amazon.com/s3/

## EBS

Block storage primarily for EC2. Volumes are Availability-Zone resources and are attached to supported compute in compatible ways.

Docs: https://docs.aws.amazon.com/ebs/

## EFS

Managed elastic file system using NFS semantics for shared file access across compatible workloads.

Docs: https://docs.aws.amazon.com/efs/

## RDS

Managed relational database service supporting multiple engines.

Understand:

- Instance sizing.
- Storage.
- Backups.
- Multi-AZ availability.
- Read replicas where supported.
- Encryption/networking.
- Connection management.

Docs: https://docs.aws.amazon.com/rds/

## Aurora

AWS-managed relational database compatible with MySQL/PostgreSQL ecosystems, with AWS-specific distributed storage/availability architecture.

Choose based on actual relational requirements, availability/scale needs, ecosystem fit, and cost—not simply because it is AWS-native.

## DynamoDB

Managed key-value/document NoSQL database.

Design starts from access patterns. Understand:

- Partition key.
- Sort key.
- Secondary indexes.
- Capacity/usage modes.
- Consistency options.
- Item size and transaction constraints (verify current limits).

Do not choose DynamoDB before modeling access patterns.

Docs: https://docs.aws.amazon.com/dynamodb/

## ElastiCache

Managed cache service for supported engines. Use when caching, session, rate-limiting, or low-latency in-memory needs justify it.

## Service-selection questions

Ask:

- Object, block, or file storage?
- Relational or non-relational model?
- Transaction/consistency requirements?
- Query/access patterns?
- Throughput and latency profile?
- Multi-AZ/multi-Region needs?
- Backup/recovery requirements?
- Network isolation/security needs?
- Operational skill and cost sensitivity?
