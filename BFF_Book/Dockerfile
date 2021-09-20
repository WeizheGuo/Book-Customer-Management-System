FROM alpine:latest
RUN apk add --no-cache nodejs npm


WORKDIR /app


COPY . /app


RUN npm install

EXPOSE 82

ENTRYPOINT ["node"]

CMD ["BFF_Book.js"]