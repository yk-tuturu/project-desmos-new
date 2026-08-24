FROM node:20-bookworm-slim AS build
WORKDIR /app

# Vite inlines VITE_* vars into the JS bundle at build time — must be passed
# as a build arg, setting it at container runtime has no effect.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
