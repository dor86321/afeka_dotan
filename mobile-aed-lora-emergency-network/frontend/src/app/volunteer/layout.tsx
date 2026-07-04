export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[#eef2f7] shadow-xl">
      {children}
    </div>
  );
}
