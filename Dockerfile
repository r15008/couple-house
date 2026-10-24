FROM node:22-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production
ENV COUPLE_DATA_DIR=/var/lib/couple-house
RUN mkdir -p /var/lib/couple-house
EXPOSE 8787
CMD ["node", "server.js"]
