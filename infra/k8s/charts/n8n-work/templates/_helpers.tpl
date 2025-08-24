{{/*
Expand the name of the chart.
*/}}
{{- define "n8n-work.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "n8n-work.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "n8n-work.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "n8n-work.labels" -}}
helm.sh/chart: {{ include "n8n-work.chart" . }}
{{ include "n8n-work.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: n8n-work
{{- end }}

{{/*
Selector labels
*/}}
{{- define "n8n-work.selectorLabels" -}}
app.kubernetes.io/name: {{ include "n8n-work.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "n8n-work.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "n8n-work.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Component-specific helper templates
*/}}

{{/*
Orchestrator helpers
*/}}
{{- define "orchestrator.name" -}}
{{- default "orchestrator" .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "orchestrator.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "orchestrator" .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "orchestrator.labels" -}}
helm.sh/chart: {{ include "n8n-work.chart" . }}
{{ include "orchestrator.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: n8n-work
app.kubernetes.io/component: orchestrator
{{- end }}

{{- define "orchestrator.selectorLabels" -}}
app.kubernetes.io/name: {{ include "orchestrator.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "orchestrator.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "orchestrator.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Engine-Go helpers
*/}}
{{- define "engine-go.name" -}}
{{- default "engine-go" .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "engine-go.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "engine-go" .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "engine-go.labels" -}}
helm.sh/chart: {{ include "n8n-work.chart" . }}
{{ include "engine-go.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: n8n-work
app.kubernetes.io/component: engine
{{- end }}

{{- define "engine-go.selectorLabels" -}}
app.kubernetes.io/name: {{ include "engine-go.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "engine-go.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "engine-go.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Node-Runner-JS helpers
*/}}
{{- define "node-runner-js.name" -}}
{{- default "node-runner-js" .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "node-runner-js.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "node-runner-js" .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "node-runner-js.labels" -}}
helm.sh/chart: {{ include "n8n-work.chart" . }}
{{ include "node-runner-js.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: n8n-work
app.kubernetes.io/component: node-runner
{{- end }}

{{- define "node-runner-js.selectorLabels" -}}
app.kubernetes.io/name: {{ include "node-runner-js.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "node-runner-js.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "node-runner-js.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}