import ResetForm from "./ResetForm";

export const dynamic = "force-dynamic";

export default function ResetPassword({ searchParams }) {
  return <ResetForm token={searchParams?.t || ""} />;
}
