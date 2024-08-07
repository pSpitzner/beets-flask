/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as TagsIndexImport } from './routes/tags/index'
import { Route as InboxIndexImport } from './routes/inbox/index'
import { Route as FrontpageIndexImport } from './routes/_frontpage/index'
import { Route as LibrarySearchImport } from './routes/library/search'
import { Route as LibraryBrowseImport } from './routes/library/browse'
import { Route as FrontpageModalImport } from './routes/_frontpage/_modal'
import { Route as LibraryBrowseArtistImport } from './routes/library/browse.$artist'
import { Route as FrontpageModalScheduleImport } from './routes/_frontpage/_modal.schedule'
import { Route as LibraryBrowseArtistAlbumIdImport } from './routes/library/browse.$artist.$albumId'
import { Route as LibraryBrowseArtistAlbumIdItemIdImport } from './routes/library/browse.$artist.$albumId.$itemId'

// Create/Update Routes

const TagsIndexRoute = TagsIndexImport.update({
  path: '/tags/',
  getParentRoute: () => rootRoute,
} as any)

const InboxIndexRoute = InboxIndexImport.update({
  path: '/inbox/',
  getParentRoute: () => rootRoute,
} as any)

const FrontpageIndexRoute = FrontpageIndexImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const LibrarySearchRoute = LibrarySearchImport.update({
  path: '/library/search',
  getParentRoute: () => rootRoute,
} as any)

const LibraryBrowseRoute = LibraryBrowseImport.update({
  path: '/library/browse',
  getParentRoute: () => rootRoute,
} as any)

const FrontpageModalRoute = FrontpageModalImport.update({
  id: '/_frontpage/_modal',
  getParentRoute: () => rootRoute,
} as any)

const LibraryBrowseArtistRoute = LibraryBrowseArtistImport.update({
  path: '/$artist',
  getParentRoute: () => LibraryBrowseRoute,
} as any)

const FrontpageModalScheduleRoute = FrontpageModalScheduleImport.update({
  path: '/schedule',
  getParentRoute: () => FrontpageModalRoute,
} as any)

const LibraryBrowseArtistAlbumIdRoute = LibraryBrowseArtistAlbumIdImport.update(
  {
    path: '/$albumId',
    getParentRoute: () => LibraryBrowseArtistRoute,
  } as any,
)

const LibraryBrowseArtistAlbumIdItemIdRoute =
  LibraryBrowseArtistAlbumIdItemIdImport.update({
    path: '/$itemId',
    getParentRoute: () => LibraryBrowseArtistAlbumIdRoute,
  } as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/_frontpage/_modal': {
      id: '/_frontpage/_modal'
      path: ''
      fullPath: ''
      preLoaderRoute: typeof FrontpageModalImport
      parentRoute: typeof rootRoute
    }
    '/library/browse': {
      id: '/library/browse'
      path: '/library/browse'
      fullPath: '/library/browse'
      preLoaderRoute: typeof LibraryBrowseImport
      parentRoute: typeof rootRoute
    }
    '/library/search': {
      id: '/library/search'
      path: '/library/search'
      fullPath: '/library/search'
      preLoaderRoute: typeof LibrarySearchImport
      parentRoute: typeof rootRoute
    }
    '/_frontpage/': {
      id: '/_frontpage/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof FrontpageIndexImport
      parentRoute: typeof rootRoute
    }
    '/inbox/': {
      id: '/inbox/'
      path: '/inbox'
      fullPath: '/inbox'
      preLoaderRoute: typeof InboxIndexImport
      parentRoute: typeof rootRoute
    }
    '/tags/': {
      id: '/tags/'
      path: '/tags'
      fullPath: '/tags'
      preLoaderRoute: typeof TagsIndexImport
      parentRoute: typeof rootRoute
    }
    '/_frontpage/_modal/schedule': {
      id: '/_frontpage/_modal/schedule'
      path: '/schedule'
      fullPath: '/schedule'
      preLoaderRoute: typeof FrontpageModalScheduleImport
      parentRoute: typeof FrontpageModalImport
    }
    '/library/browse/$artist': {
      id: '/library/browse/$artist'
      path: '/$artist'
      fullPath: '/library/browse/$artist'
      preLoaderRoute: typeof LibraryBrowseArtistImport
      parentRoute: typeof LibraryBrowseImport
    }
    '/library/browse/$artist/$albumId': {
      id: '/library/browse/$artist/$albumId'
      path: '/$albumId'
      fullPath: '/library/browse/$artist/$albumId'
      preLoaderRoute: typeof LibraryBrowseArtistAlbumIdImport
      parentRoute: typeof LibraryBrowseArtistImport
    }
    '/library/browse/$artist/$albumId/$itemId': {
      id: '/library/browse/$artist/$albumId/$itemId'
      path: '/$itemId'
      fullPath: '/library/browse/$artist/$albumId/$itemId'
      preLoaderRoute: typeof LibraryBrowseArtistAlbumIdItemIdImport
      parentRoute: typeof LibraryBrowseArtistAlbumIdImport
    }
  }
}

// Create and export the route tree

export const routeTree = rootRoute.addChildren({
  FrontpageModalRoute: FrontpageModalRoute.addChildren({
    FrontpageModalScheduleRoute,
  }),
  LibraryBrowseRoute: LibraryBrowseRoute.addChildren({
    LibraryBrowseArtistRoute: LibraryBrowseArtistRoute.addChildren({
      LibraryBrowseArtistAlbumIdRoute:
        LibraryBrowseArtistAlbumIdRoute.addChildren({
          LibraryBrowseArtistAlbumIdItemIdRoute,
        }),
    }),
  }),
  LibrarySearchRoute,
  FrontpageIndexRoute,
  InboxIndexRoute,
  TagsIndexRoute,
})

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/_frontpage/_modal",
        "/library/browse",
        "/library/search",
        "/_frontpage/",
        "/inbox/",
        "/tags/"
      ]
    },
    "/_frontpage/_modal": {
      "filePath": "_frontpage/_modal.tsx",
      "children": [
        "/_frontpage/_modal/schedule"
      ]
    },
    "/library/browse": {
      "filePath": "library/browse.tsx",
      "children": [
        "/library/browse/$artist"
      ]
    },
    "/library/search": {
      "filePath": "library/search.tsx"
    },
    "/_frontpage/": {
      "filePath": "_frontpage/index.tsx"
    },
    "/inbox/": {
      "filePath": "inbox/index.tsx"
    },
    "/tags/": {
      "filePath": "tags/index.tsx"
    },
    "/_frontpage/_modal/schedule": {
      "filePath": "_frontpage/_modal.schedule.tsx",
      "parent": "/_frontpage/_modal"
    },
    "/library/browse/$artist": {
      "filePath": "library/browse.$artist.tsx",
      "parent": "/library/browse",
      "children": [
        "/library/browse/$artist/$albumId"
      ]
    },
    "/library/browse/$artist/$albumId": {
      "filePath": "library/browse.$artist.$albumId.tsx",
      "parent": "/library/browse/$artist",
      "children": [
        "/library/browse/$artist/$albumId/$itemId"
      ]
    },
    "/library/browse/$artist/$albumId/$itemId": {
      "filePath": "library/browse.$artist.$albumId.$itemId.tsx",
      "parent": "/library/browse/$artist/$albumId"
    }
  }
}
ROUTE_MANIFEST_END */
