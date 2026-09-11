---
last_reviewed: 2026-09-11
---

# AWS messaging and events

Use for asynchronous processing, integration, event-driven design, and streaming.

## SQS

Durable managed message queue.

Use for work queues, decoupling, load leveling, retry isolation, and asynchronous processing.

Important concepts:

- Standard vs FIFO queues.
- Visibility timeout.
- Long polling.
- Dead-letter queues.
- At-least-once delivery behavior for Standard queues.
- Idempotent consumers.

Verify exact guarantees/limits for the selected queue type.

Docs: https://docs.aws.amazon.com/sqs/

## SNS

Managed pub/sub notification service supporting fan-out to multiple subscribers/endpoints.

Common pattern:

producer -> SNS topic -> SQS queues / Lambda / other supported subscribers

Docs: https://docs.aws.amazon.com/sns/

## EventBridge

Managed event bus and routing service for AWS services, applications, and SaaS integrations.

Useful for event routing, filtering, scheduled events, and loosely coupled event-driven integration.

Docs: https://docs.aws.amazon.com/eventbridge/

## Kinesis

Streaming services for high-throughput real-time data ingestion/processing use cases. Do not substitute Kinesis for a normal work queue unless stream semantics are required.

Docs: https://docs.aws.amazon.com/kinesis/

## Mental model

- Queue: one message is processed as work by a consumer pattern.
- Pub/sub: publish once, deliver to multiple interested subscribers.
- Event bus: route/filter events between producers and consumers.
- Stream: ordered/time-based flow of records for streaming processing.

## Reliability checklist

For asynchronous consumers, consider:

- Idempotency.
- Retry/backoff.
- Poison messages / DLQ.
- Ordering requirements.
- Duplicate delivery.
- Visibility/acknowledgement semantics.
- Observability and age-of-message/backlog metrics.
