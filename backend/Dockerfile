FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install flask flask-cors reverse_geocoder pycountry
EXPOSE 5000
CMD ["python", "app.py"]

