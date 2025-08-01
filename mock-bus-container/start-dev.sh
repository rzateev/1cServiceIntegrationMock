#!/bin/sh
set -e

echo "--- Starting Backend in background ---"
(cd /app/backend && npm start) &

echo "--- Waiting for Backend to be ready on port 9090 ---"
while ! nc -z localhost 9090; do   
  sleep 0.1 # wait for 1/10 of a second before check again
done
echo "--- Backend is ready! ---"

echo "--- Starting Frontend (Vite Dev Server) ---"
(cd /app/frontend && npm start)