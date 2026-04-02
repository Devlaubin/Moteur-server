FROM searxng/searxng:latest

COPY settings.yml /etc/searxng/settings.yml

EXPOSE 8080

CMD ["/usr/local/searxng/bin/python", "-m", "searxng"]
