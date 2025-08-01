# Frontend build stage
FROM node:20 AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Backend build stage
FROM node:20 AS build-backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# Final stage
FROM node:20

RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend files (dependencies and compiled code)
COPY --from=build-backend /app/backend/dist ./backend/dist
COPY --from=build-backend /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/

# Copy frontend files (source code for Vite dev server and dependencies)
COPY --from=build-frontend /app/frontend/node_modules ./frontend/node_modules
COPY frontend ./frontend

# Copy and prepare start script
COPY start-dev.sh ./
RUN chmod +x ./start-dev.sh

ENV NODE_ENV=development
EXPOSE 9090
EXPOSE 3090

ENTRYPOINT ["./start-dev.sh"]