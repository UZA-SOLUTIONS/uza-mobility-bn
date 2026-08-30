# Build the static bundle, then serve it from nginx. Two stages so the runtime image
# carries no node_modules and no source.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite inlines env at build time, so the API base URL is a build argument, not a
# runtime one. A different environment means a different image — which is also what
# makes the image reproducible.
ARG VITE_API_BASE_URL=/api
ARG VITE_ENVIRONMENT=production
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_ENVIRONMENT=$VITE_ENVIRONMENT
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
