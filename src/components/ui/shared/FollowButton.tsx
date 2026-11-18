import { useEffect, useState } from "react";

import { Button } from "../button";
import { useUserContext } from "@/context/AuthContext";
import { useFollowUser } from "@/lib/react-query/queriesAndMutations";
import { canFollow } from "@/lib/api";

type FollowButtonProps = {
  userId: string;
  isFollowing?: boolean;
  size?: "default" | "sm";
  className?: string;
};

// Used on the profile page and in the user cards of the "People" page.
// In the tutorial this was a button without any function.
const FollowButton = ({ userId, isFollowing = false, size = "default", className = "" }: FollowButtonProps) => {
  const { user } = useUserContext();
  const { mutate: followUser, isPending } = useFollowUser();
  const [following, setFollowing] = useState(isFollowing);

  // take over the new value after the server answered
  useEffect(() => setFollowing(isFollowing), [isFollowing]);

  // no button for yourself (and none with the Appwrite backend)
  if (!canFollow || !user.id || user.id === userId) return null;

  const handleClick = (e: React.MouseEvent) => {
    // the user card is a <Link>: without this, clicking would also open the profile
    e.preventDefault();
    e.stopPropagation();

    const next = !following;
    setFollowing(next); // show the change immediately ("optimistic update")
    followUser(
      { userId, follow: next },
      {
        onSuccess: (updated) => {
          if (!updated) setFollowing(!next); // the server said no -> undo
        },
        onError: () => setFollowing(!next),
      }
    );
  };

  return (
    <Button
      type="button"
      size={size}
      disabled={isPending}
      onClick={handleClick}
      className={`${following ? "shad-button_dark_4" : "shad-button_primary"} px-5 ${className}`}
    >
      {following ? "Following" : "Follow"}
    </Button>
  );
};

export default FollowButton;
