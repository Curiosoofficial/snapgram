import {
    useQuery,
    useMutation,
    useQueryClient,
    useInfiniteQuery,
    QueryClient,
} from '@tanstack/react-query'
import { createPost, createUserAccount, deletePost, deleteSavedPost, followUser, getCurrentUser, getInfinitePosts, getPostById, getRecentPosts, getUserById, getUsers, likePost, savePost, searchPosts, signInAccount, signOutAccount, updatePost, updateUser } from '../api'
import { INewPost, INewUser, IPostFilter, IUpdatePost, IUpdateUser } from '@/types'
import { QUERY_KEYS } from './queryKeys'

// Every list that can show a post: home feed, explore grid and the profiles
const invalidatePostLists = (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_RECENT_POSTS] })
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_INFINITE_POSTS] })
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_CURRENT_USER] })
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_USER_BY_ID] })
}

export const useCreateUserAccount = () => {
    return useMutation({
        mutationFn: (user: INewUser) => createUserAccount(user)
    })
}

export const useSignInAccount = () => {
    return useMutation({
        mutationFn: (user: {
            email: string;
            password: string;
        }) => signInAccount(user)
    })
}

export const useSignOutAccount = () => {
    return useMutation({
        mutationFn: signOutAccount
    })
}

export const useCreatePost = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (post: INewPost) => createPost(post),
        onSuccess: () => invalidatePostLists(queryClient)
    })
};

export const useGetRecentPosts = () => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_RECENT_POSTS],
        queryFn: getRecentPosts,
    })
}

export const useLikePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, likesArray }: { postId: string; likesArray: string[] }) => likePost(postId, likesArray),
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_POST_BY_ID, data?.$id]
            })
            // GET_POSTS was never used as a query key, so the explore
            // grid was not refreshed. GET_INFINITE_POSTS is the right one.
            invalidatePostLists(queryClient)
        }
    })
}

export const useSavePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, userId }: { postId: string; userId: string }) => savePost(postId, userId),
        onSuccess: () => invalidatePostLists(queryClient)
    })
}

export const useDeleteSavedPost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (savedRecordId: string) => deleteSavedPost(savedRecordId),
        onSuccess: () => invalidatePostLists(queryClient)
    })
}

export const useGetCurrentUser = () => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_CURRENT_USER],
        queryFn: getCurrentUser
    })
}

export const useGetPostById = (postId: string) => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_POST_BY_ID, postId],
        queryFn: () => getPostById(postId),
        enabled: !!postId
    })
}

export const useUpdatePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (post: IUpdatePost) => updatePost(post),
        onSuccess: (data) => {
            queryClient.invalidateQueries({
                queryKey: [QUERY_KEYS.GET_POST_BY_ID, data?.$id]
            })
            invalidatePostLists(queryClient)
        }
    })
}

export const useDeletePost = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ postId, imageId }: { postId: string, imageId: string }) => deletePost(postId, imageId),
        onSuccess: () => invalidatePostLists(queryClient)
    })
}

export const useGetPosts = (filter: IPostFilter = "all") => {
    return useInfiniteQuery({
        // one cache entry per filter; invalidating [GET_INFINITE_POSTS] refreshes all of them
        queryKey: [QUERY_KEYS.GET_INFINITE_POSTS, filter],
        queryFn: ({ pageParam }) => getInfinitePosts({ pageParam, filter }),
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => {
            if (!lastPage || lastPage.documents.length === 0) {
                return null;
            }

            // The id of the last post is the cursor for the next page
            return lastPage.documents[lastPage.documents.length - 1].$id;
        },
    });
};

export const useSearchPosts = (searchTerm: string) => {
    return useQuery({
        queryKey: [QUERY_KEYS.SEARCH_POSTS, searchTerm],
        queryFn: () => searchPosts(searchTerm),
        enabled: !!searchTerm
    })
}

export const useGetUserById = (userId: string) => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_USER_BY_ID, userId],
        queryFn: () => getUserById(userId),
        enabled: !!userId,
    });
};

export const useUpdateUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (user: IUpdateUser) => updateUser(user),
        onSuccess: () => {
            // Name and avatar also appear on posts and in the user list
            invalidatePostLists(queryClient)
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_USERS] })
        },
    });
};

export const useFollowUser = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) => followUser(userId, follow),
        onSuccess: () => {
            // follower counts on profiles, the Follow buttons in the people list
            // and the "Following" filter on the explore page
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_USER_BY_ID] })
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_USERS] })
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_CURRENT_USER] })
            queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GET_INFINITE_POSTS] })
        },
    });
};

export const useGetUsers = (limit?: number) => {
    return useQuery({
        queryKey: [QUERY_KEYS.GET_USERS],
        queryFn: () => getUsers(limit),
    });
};
