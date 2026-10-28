const shutdownController = new AbortController();
const shutdownSignal = shutdownController.signal;
// Open event streams keep their connections busy, so the HTTP server can't close until they end.
const endEventStreams = (): void => shutdownController.abort();

export { endEventStreams, shutdownSignal };
