# ==============================================================================
# FRONTEND DOCKERFILE - EXPENSE TRACKER (React + TypeScript + Vite)
# Multi-stage build: Build with Node 20 -> Serve with Nginx Alpine
# ==============================================================================

# Stage 1: Build static assets
FROM node:20-alpine as build-stage
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production web server
FROM nginx:alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
