import { backend } from "@/lib/api";
import { resetDemoData } from "@/lib/demo/store";

// Shown on the sign-in/sign-up pages of the public demo
const DemoNotice = () => {
  if (backend === "appwrite") return null;

  const handleReset = () => {
    resetDemoData();
    window.location.reload();
  };

  return (
    <div className="w-full rounded-xl border border-primary-500/40 bg-primary-500/10 px-4 py-3 mt-6 text-left">
      <p className="small-semibold text-light-1">{backend === "demo" ? "Offline demo" : "Public demo"}</p>
      <p className="subtle-semibold text-light-2 mt-1 leading-relaxed">
        {backend === "demo"
          ? "Accounts, posts and likes are stored only in this browser."
          : "Posts are visible to everyone and all data is reset every 24 hours."}{" "}
        Please don't use a real password.
      </p>
      {backend === "demo" && (
        <button
          type="button"
          onClick={handleReset}
          className="subtle-semibold text-primary-500 mt-2 hover:underline"
        >
          Reset demo data
        </button>
      )}
    </div>
  );
};

export default DemoNotice;
