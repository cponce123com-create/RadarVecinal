export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  setBaseUrl,
  setAuthTokenGetter,
  setAuthTokenRefresher,
  customFetch,
  // Las clases de error se exportan para que el consumidor pueda distinguir
  // un fallo HTTP del servidor (ApiError, con `status` y `data`) de un fallo
  // de red o de una respuesta ilegible.
  ApiError,
  ResponseParseError,
} from "./custom-fetch";
export type {
  AuthTokenGetter,
  AuthTokenRefresher,
  CustomFetchOptions,
} from "./custom-fetch";
