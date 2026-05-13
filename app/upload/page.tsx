import { UploadStudio } from "@/components/upload/UploadStudio";

export const metadata = {
  title: "Upload Studio · Q Tax",
  description:
    "Drop an FTA open-data file — five TADAT agents fire in parallel, summary lands in under 30 seconds.",
};

export default function UploadPage() {
  return <UploadStudio />;
}
