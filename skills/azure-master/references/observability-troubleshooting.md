---
last_reviewed: 2026-09-11
---

# Azure observability and troubleshooting

Use for Azure Monitor, Application Insights, Log Analytics, KQL, diagnostics, alerts, and production troubleshooting.

## Current mental model

Azure Monitor is Microsoft's unified observability service for collecting, analyzing, and acting on telemetry from cloud and hybrid environments.

Application Insights is part of Azure Monitor's application performance monitoring experience and is aligned with OpenTelemetry for application telemetry.

Log Analytics workspaces store log/trace data that can be queried with KQL.

## Telemetry types

- Metrics: numeric time-series signals.
- Logs: structured/semi-structured records useful for investigation.
- Traces: request/dependency execution paths.
- Events: noteworthy occurrences/state changes.
- Alerts: rules that notify or trigger action when conditions are met.

## Troubleshooting method

Start from symptom and time window. Then correlate:

- Deployment/change history.
- Application exceptions.
- Request/dependency telemetry.
- Platform metrics.
- Resource logs.
- Identity/authorization errors.
- Network/DNS evidence.
- Dependency health.

Avoid changing several controls at once; doing so destroys diagnostic signal.

## Official sources

- Azure Monitor: https://learn.microsoft.com/azure/azure-monitor/
- Azure Monitor overview: https://learn.microsoft.com/azure/azure-monitor/fundamentals/overview
- Log Analytics: https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview
