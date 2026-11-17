FROM node:24-alpine

# Retained for dependencies or integrations that use Git.
RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Keep the existing runtime identity and persistent paths compatible.
RUN addgroup -S hoyolab && adduser -S -G hoyolab hoyolab && \
    mkdir -p /app/data /app/logs && \
    chown -R hoyolab:hoyolab /app

USER hoyolab

ENV TZ=Asia/Shanghai

CMD ["npm", "start"]
