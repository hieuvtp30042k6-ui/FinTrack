import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST  # type: ignore
    PROMETHEUS_AVAILABLE = True

    # 1. Tổng số request theo method, path, HTTP status (F09)
    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total HTTP requests processed by Expense Tracker API",
        ["method", "endpoint", "http_status"]
    )

    # 2. Thời gian phản hồi request (Latency / Response time) (F09)
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency in seconds",
        ["method", "endpoint"],
        buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
    )

    # 3. Số request đang được xử lý đồng thời (Concurrent requests)
    IN_PROGRESS_REQUESTS = Gauge(
        "http_requests_in_progress",
        "Number of HTTP requests currently being processed",
        ["method", "endpoint"]
    )

    # 4. Số lỗi 4xx, 5xx (Error rate) (F09)
    ERROR_COUNT = Counter(
        "http_request_errors_total",
        "Total number of HTTP request errors",
        ["method", "endpoint", "status_class"]
    )

except ImportError:
    PROMETHEUS_AVAILABLE = False


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not PROMETHEUS_AVAILABLE or request.url.path == "/metrics":
            return await call_next(request)

        method = request.method
        path = request.url.path

        # Normalize high-cardinality paths (replace digits with {id})
        parts = path.split("/")
        normalized_parts = [
            "{id}" if part.isdigit() else part for part in parts
        ]
        endpoint = "/".join(normalized_parts) or "/"

        IN_PROGRESS_REQUESTS.labels(method=method, endpoint=endpoint).inc()
        start_time = time.time()
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
        except Exception:
            status_code = 500
            raise
        finally:
            duration = time.time() - start_time
            IN_PROGRESS_REQUESTS.labels(method=method, endpoint=endpoint).dec()
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, http_status=status_code).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)

            if status_code >= 500:
                ERROR_COUNT.labels(method=method, endpoint=endpoint, status_class="5xx").inc()
            elif status_code >= 400:
                ERROR_COUNT.labels(method=method, endpoint=endpoint, status_class="4xx").inc()

        return response


def get_metrics_response() -> Response:
    if not PROMETHEUS_AVAILABLE:
        return Response(content="# Prometheus client not installed\n", media_type="text/plain")
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
