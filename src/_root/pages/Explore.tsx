import { Input } from '@/components/ui/input'
import GridPostList from '@/components/ui/shared/GridPostList';
import Loader from '@/components/ui/shared/Loader';
import PostFilterMenu from '@/components/ui/shared/PostFilterMenu';
import { postFilters } from '@/constants';
import useDebounce from '@/hooks/useDebounce';
import { useGetPosts, useSearchPosts } from '@/lib/react-query/queriesAndMutations';
import { IPostFilter } from '@/types';
import { useState, useEffect } from 'react'
import { useInView } from 'react-intersection-observer';
import { Models } from 'appwrite';


export type SearchResultProps = {
  isSearchFetching: boolean;
  searchedPosts?: Models.DocumentList<Models.Document>;
};

const SearchResults = ({ isSearchFetching, searchedPosts }: SearchResultProps) => {
  if (isSearchFetching) {
    return <Loader />;
  } else if (searchedPosts && searchedPosts.documents.length > 0) {
    return <GridPostList posts={searchedPosts.documents} />;
  } else {
    return (
      <p className="text-light-4 mt-10 text-center w-full">No results found</p>
    );
  }
};

const EMPTY_MESSAGES: Record<IPostFilter, string> = {
  all: "End of posts",
  following: "No posts yet. Follow people on the People page to see their posts here.",
  popular: "End of posts",
};

const Explore = () => {
  const { ref, inView } = useInView();
  // the "All" button next to the heading used to be a placeholder without function
  const [filter, setFilter] = useState<IPostFilter>("all");
  const { data: posts, fetchNextPage, hasNextPage } = useGetPosts(filter);

  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 500);
  const { data: searchedPosts, isFetching: isSearchFetching } = useSearchPosts(debouncedSearch);

  useEffect(() => {
    if (inView && !searchValue) {
      fetchNextPage();
    }
  }, [inView, searchValue, fetchNextPage]);

  const shouldShowSearchResults = searchValue !== "";
  const isEmpty = !!posts && posts.pages.every((item) => !item || item.documents.length === 0);
  const heading = postFilters.find((f) => f.value === filter)?.heading;

  return (
    <div className="explore-container">
      <div className="explore-inner_container">
        <h2 className="h3-bold md:h2-bold w-full">Search Posts</h2>
        <div className="flex gap-1 px-4 w-full rounded-lg bg-dark-4">
          <img
            src="/assets/icons/search.svg"
            width={24}
            height={24}
            alt="search"
          />
          <Input
            type="text"
            placeholder="Search"
            className="explore-search"
            value={searchValue}
            onChange={(e) => {
              const { value } = e.target;
              setSearchValue(value);
            }}
          />
        </div>
      </div>

      <div className="flex-between w-full max-w-5xl mt-16 mb-7">
        <h3 className="body-bold md:h3-bold">
          {shouldShowSearchResults ? "Search Results" : heading}
        </h3>

        {!shouldShowSearchResults && <PostFilterMenu value={filter} onChange={setFilter} />}
      </div>

      <div className="flex flex-wrap gap-9 w-full max-w-5xl">
        {shouldShowSearchResults ? (
          <SearchResults
            isSearchFetching={isSearchFetching}
            searchedPosts={searchedPosts}
          />
        ) : !posts ? (
          <Loader />
        ) : isEmpty ? (
          <p className="text-light-4 mt-10 text-center w-full">{EMPTY_MESSAGES[filter]}</p>
        ) : (
          posts.pages.map((item, index) => (
            item && <GridPostList key={`page-${index}`} posts={item.documents} />
          ))
        )}
      </div>

      {hasNextPage && !searchValue && !isEmpty && (
        <div ref={ref} className="mt-10">
          <Loader />
        </div>
      )}
    </div>
  );
};

export default Explore;
