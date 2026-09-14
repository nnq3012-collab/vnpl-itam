import ReferenceBackLink from "./back-link";

export default function ReferenceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ReferenceBackLink />
      {children}
    </div>
  );
}
