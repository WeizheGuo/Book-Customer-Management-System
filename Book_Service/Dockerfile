FROM alpine:latest
RUN apk add --no-cache nodejs npm


WORKDIR /app


COPY . /app


RUN npm install

EXPOSE 3002

ENTRYPOINT ["node"]

CMD ["Book.js"]