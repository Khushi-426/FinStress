FROM python:3.11-slim
WORKDIR /app
COPY ml/requirements.txt ./ml/
RUN pip install --no-cache-dir -r ml/requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "ml.service:app", "--host", "0.0.0.0", "--port", "8000"]
