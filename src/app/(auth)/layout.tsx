import { Logo } from "@/components/brand/logo";
import { APP_TAGLINE } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo variant="white" />
        <div className="space-y-4">
          <h1 className="font-display text-5xl font-bold leading-tight">
            Home rental
            <br />
            made <span className="text-accent">instant</span>.
          </h1>
          <p className="max-w-md text-lg text-primary-foreground/80">{APP_TAGLINE}</p>
        </div>
        <p className="text-sm text-primary-foreground/60">
          Speed · Security · Simplicity · Community
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
