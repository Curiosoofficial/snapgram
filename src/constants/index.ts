import { IPostFilter } from "@/types";

export const sidebarLinks = [
    {
      imgURL: "/assets/icons/home.svg",
      route: "/",
      label: "Home",
    },
    {
      imgURL: "/assets/icons/wallpaper.svg",
      route: "/explore",
      label: "Explore",
    },
    {
      imgURL: "/assets/icons/people.svg",
      route: "/all-users",
      label: "People",
    },
    {
      imgURL: "/assets/icons/bookmark.svg",
      route: "/saved",
      label: "Saved",
    },
    {
      imgURL: "/assets/icons/gallery-add.svg",
      route: "/create-post",
      label: "Create Post",
    },
  ];
  
  export const bottombarLinks = [
    {
      imgURL: "/assets/icons/home.svg",
      route: "/",
      label: "Home",
    },
    {
      imgURL: "/assets/icons/wallpaper.svg",
      route: "/explore",
      label: "Explore",
    },
    {
      imgURL: "/assets/icons/bookmark.svg",
      route: "/saved",
      label: "Saved",
    },
    {
      imgURL: "/assets/icons/gallery-add.svg",
      route: "/create-post",
      label: "Create",
    },
  ];

// Filter options on the Explore page
export const postFilters: Array<{ value: IPostFilter; label: string; heading: string }> = [
  { value: "all", label: "All", heading: "Latest Posts" },
  { value: "following", label: "Following", heading: "From People You Follow" },
  { value: "popular", label: "Popular", heading: "Most Liked" },
];
