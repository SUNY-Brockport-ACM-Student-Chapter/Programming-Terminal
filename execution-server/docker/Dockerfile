FROM debian:bookworm-slim

# Chain all package installations to create one new image layer. Each RUN command adds a new layer. Fewer layers = smaller image
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    default-jdk \
    gcc \
    build-essential \
    sbcl \
    swi-prolog \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user named 'coderunner' and a home directory
RUN useradd -m -s /bin/bash coderunner && \
    # this is where the user source files will be written
    mkdir -p /code && \ 
    # give the coderunner user ownership of /code so they can write files to it
    chown coderunner:coderunner /code

# Set /code as the working directory for all further commands
WORKDIR /code
# Switch from root to coderunner user
USER coderunner

# Keeps the container alive indefinitely 
CMD ["tail", "-f", "/dev/null"]