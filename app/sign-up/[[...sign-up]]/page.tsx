import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-zinc-950 border border-zinc-800 shadow-xl",
          },
        }}
      />
    </div>
  );
}
