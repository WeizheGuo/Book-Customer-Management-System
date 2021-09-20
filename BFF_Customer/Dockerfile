FROM alpine:latest
RUN apk add --no-cache nodejs npm


WORKDIR /app


COPY . /app


RUN npm install


EXPOSE 81

ENTRYPOINT ["node"]

CMD ["BFF_Customer.js"]