FROM python:3.11-slim

WORKDIR /app

# Install dependencies  
RUN pip install redis[hiredis]==4.6.0 pandas==2.1.4 flask==3.0.0 flask-cors==4.0.0

# Copy application files
COPY . .

# Command will be overridden by docker-compose
CMD ["python", "load_data.py"] 