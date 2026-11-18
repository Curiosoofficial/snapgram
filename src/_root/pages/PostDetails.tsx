import { Button } from "@/components/ui/button";
import Loader from "@/components/ui/shared/Loader";
import PostStats from "@/components/ui/shared/PostStats";
import { useUserContext } from "@/context/AuthContext";
import { useDeletePost, useGetPostById } from "@/lib/react-query/queriesAndMutations";
import { multiFormatDateString } from "@/lib/utils";
import { Link, useNavigate, useParams } from "react-router-dom";

const PostDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: post, isPending } = useGetPostById(id || "");
  const { user } = useUserContext();
  const { mutate: deletePost, isPending: isDeleting } = useDeletePost();

  // was an empty function "() => {}", so the delete button did nothing
  const handleDeletePost = () => {
    if (!post) return;

    deletePost(
      { postId: post.$id, imageId: post.imageId },
      // navigate to a fixed route instead of navigate(-1): opened via a direct
      // link (e.g. inside an iframe) there is no previous page to go back to
      { onSuccess: () => navigate("/") }
    );
  };

  if (isPending) {
    return (
      <div className="post_details-container">
        <Loader />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="post_details-container">
        <p className="text-light-4 mt-10 text-center w-full">
          This post doesn't exist (anymore).
        </p>
        <Link to="/" className="text-primary-500 small-semibold">
          Back to the feed
        </Link>
      </div>
    );
  }

  const isCreator = user.id === post.creator?.$id;

  return (
    <div className="post_details-container">
      <div className="post_details-card">
        <img src={post.imageUrl} alt="post" className="post_details-img" />

        <div className="post_details-info">
          <div className="flex-between w-full">
            <Link
              to={`/profile/${post.creator?.$id}`}
              className="flex items-center gap-3"
            >
              <img
                src={
                  post.creator?.imageUrl ||
                  "/assets/icons/profile-placeholder.svg"
                }
                alt="creator"
                className="rounded-full w-8 h-8 lg:w-12 lg:h-12 object-cover"
              />

              <div className="flex flex-col">
                <p className="base-medium lg:body-bold text-light-1">
                  {post.creator?.name}
                </p>

                <div className="flex-center gap-2 text-light-3">
                  <p className="subtle-semibold lg:small-regular">
                    {multiFormatDateString(post.$createdAt)}
                  </p>
                  -
                  <p className="subtle-semibold lg:small-regular capitalize">
                    {post.location}
                  </p>
                </div>
              </div>
            </Link>

            {isCreator && (
              <div className="flex-center gap-4">
                <Link to={`/update-post/${post.$id}`}>
                  <img
                    src="/assets/icons/edit.svg"
                    width={24}
                    height={24}
                    alt="edit"
                  />
                </Link>

                <Button
                  onClick={handleDeletePost}
                  variant="ghost"
                  disabled={isDeleting}
                  className="post_details-delete_btn"
                >
                  <img
                    src="/assets/icons/delete.svg"
                    alt="delete"
                    width={24}
                    height={24}
                  />
                </Button>
              </div>
            )}
          </div>

          <hr className="border w-full border-dark-4/80" />

          <div className="flex flex-col flex-1 small-medium lg:base-regular">
            <p>{post.caption}</p>
            <ul className="flex flex-wrap gap-1 mt-2">
              {post.tags.map((tag: string) => (
                <li key={tag} className="text-light-3">
                  #{tag}
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full">
            <PostStats post={post} userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetails;
