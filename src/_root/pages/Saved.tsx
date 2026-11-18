import { Models } from "appwrite";

import Loader from "@/components/ui/shared/Loader";
import GridPostList from "@/components/ui/shared/GridPostList";
import { useGetCurrentUser } from "@/lib/react-query/queriesAndMutations";

const Saved = () => {
  const { data: currentUser } = useGetCurrentUser();

  // Before, every saved post got the CURRENT user's avatar as "creator",
  // so all saved posts looked like your own. Deleted posts (post = null)
  // are skipped instead of crashing.
  const savePosts: Models.Document[] = (currentUser?.save ?? [])
    .map((saveRecord: Models.Document) => saveRecord.post)
    .filter(Boolean)
    .reverse();

  return (
    <div className="saved-container">
      <div className="flex gap-2 w-full max-w-5xl">
        <img
          src="/assets/icons/save.svg"
          width={36}
          height={36}
          alt="edit"
          className="invert-white"
        />
        <h2 className="h3-bold md:h2-bold text-left w-full">Saved Posts</h2>
      </div>

      {!currentUser ? (
        <Loader />
      ) : (
        <div className="w-full flex justify-center max-w-5xl gap-9">
          {savePosts.length === 0 ? (
            <p className="text-light-4">No available posts</p>
          ) : (
            <GridPostList posts={savePosts} showStats={false} />
          )}
        </div>
      )}
    </div>
  );
};

export default Saved;
