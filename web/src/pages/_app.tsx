import type { ReactElement, ReactNode } from "react";
import "virtual:uno.css";
import "../index.css";

type AppProps = {
  readonly Component: (props: Record<string, unknown>) => ReactElement;
  readonly pageProps: Record<string, unknown>;
};

export default function WebApp({ Component, pageProps }: AppProps): ReactNode {
  return <Component {...pageProps} />;
}
