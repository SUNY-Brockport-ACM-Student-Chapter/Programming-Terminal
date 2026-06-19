FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    default-jdk \
    gcc \
    build-essential \
    sbcl \
    swi-prolog \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash coderunner && \
    mkdir -p /code && \
    chown coderunner:coderunner /code

WORKDIR /code
USER coderunner

CMD ["tail", "-f", "/dev/null"]