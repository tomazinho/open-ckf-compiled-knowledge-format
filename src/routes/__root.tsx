import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/i18n/context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Open CKF — Open-source compiler for the Compiled Knowledge Format" },
      { name: "description", content: "Compile any document into a structured .ckf package — Compiled Knowledge Format. 100% client-side, BYOK, no servers." },
      { name: "author", content: "Compiled Knowledge Format" },
      { property: "og:title", content: "Open CKF — Open-source compiler for the Compiled Knowledge Format" },
      { property: "og:description", content: "Compile any document into a structured .ckf package. 100% client-side, BYOK, no servers." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Open CKF" },
      { property: "og:url", content: "https://open.compiledknowledgeformat.org" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Open CKF — Open-source compiler for the Compiled Knowledge Format" },
      { name: "twitter:description", content: "Compile any document into a structured .ckf package. 100% client-side, BYOK, no servers." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7f7a4db1-7dc0-4bc6-973a-c3080641d3c4/id-preview-6efa53db--62842ee8-3430-4a2c-9d23-8189697c924f.lovable.app-1778866848952.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7f7a4db1-7dc0-4bc6-973a-c3080641d3c4/id-preview-6efa53db--62842ee8-3430-4a2c-9d23-8189697c924f.lovable.app-1778866848952.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <Outlet />
          <Toaster />
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
