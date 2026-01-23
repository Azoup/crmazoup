import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep it in console to debug future edge cases without blanking the UI
    console.error("React render crash:", error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleTryRecover = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-card border border-border rounded-xl p-6 space-y-4">
          <h1 className="text-xl font-bold">Ocorreu um erro inesperado</h1>
          <p className="text-sm text-muted-foreground">
            Para evitar a tela branca, o app entrou em modo de recuperação. Você pode tentar voltar sem
            recarregar, ou recarregar a página.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleTryRecover}>
              Tentar voltar
            </Button>
            <Button onClick={this.handleReload}>Recarregar</Button>
          </div>
        </div>
      </div>
    );
  }
}
