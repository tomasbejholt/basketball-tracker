FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libxcb1 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    wget \
    xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && wget -q "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" -O /tmp/ff.tar.xz \
    && tar xf /tmp/ff.tar.xz -C /tmp \
    && mv /tmp/ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ffmpeg \
    && mv /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ffprobe \
    && rm -rf /tmp/ff.tar.xz /tmp/ffmpeg-*-amd64-static

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
