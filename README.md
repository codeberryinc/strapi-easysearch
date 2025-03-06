# **EasySearch - Strapi Plugin**  

A Strapi v5 plugin providing transliterated fuzzy search capabilities and advanced filtering logic for both GraphQL and REST APIs.
> **✅ Compatible with Strapi v5.10.3 and above** 

![Strapi Version](https://img.shields.io/badge/Strapi-v5.10.3+-purple?style=flat-square)  
![License](https://img.shields.io/github/license/codeberryinc/strapi-tagger?style=flat-square)
![NPM Version](https://img.shields.io/npm/v/@codeberry/easysearch?style=flat-square)
## 🚀 Features

- **Transliterated fuzzy search**: Supports searches in multiple languages.
- **Subscription-based filtering**: Controls access to content based on subscription levels.
- Dynamic population of relational and media fields.
- Supports both REST and GraphQL APIs.
- Customizable via Strapi config.

## 🚀 Installation

```bash
npm install @codeberry/easysearch

```

or using yarn:

```bash
yarn add @codeberry/easysearch

```

## ⚙️ Configuration

Configure your content types in `config/plugins.ts` or `config/plugins.js`:

```typescript
export default ({ env }) => ({
  'easy-search': {
    enabled: true,
    contentTypes: [
      {
        uid: 'api::article.article',
        searchFields: ['title', 'content', 'excerpt'],
      },
      {
        uid: 'api::offer.offer',
        searchFields: ['title', 'content', 'excerpt'],
      },
      // add your additional content types here
    ],
  },
};
```

## 🎯 Usage

**REST API**

Request example:

```http
GET /api/easy-search/search?query=example&page=1&pageSize=10&populate=featuredMedia,image
```

REST Parameters support:  
- `fields`: Select specific fields
- `populate`: Populate nested relations

### Example REST API call:

```sh
GET http://localhost:1337/api/easy-search/search?query=example&page=1&pageSize=10&fields=title,excerpt,slug&populate=featuredMedia.image
```

### Example Response

```json
{
  "data": {
    "results": {
      "article": [
        {
          "documentId": "t7cjl6b2d1alh1povri06jzw",
          "title": "Cras ultricies mi eu turpis",
          "slug": "cras-ultricies-mi-eu-turpis",
          "featuredMedia": {
            "image": {
              "url": "https://images.example.com/image.jpg"
            }
          }
        }
      ]
    },
    "meta": {
      "pagination": {
        "page": 1,
        "pageSize": 10,
        "pageCount": 1,
        "total": 1
      }
    }
  }
```

### Example GraphQL Query:

```graphql
query {
  search(query: "example", page: 1, pageSize: 10) {
    article {
      title
      slug
      featuredMedia {
        image {
          url
        }
      }
    }
  }
}
```

---

## ⚙️ Middleware (optional)

You can optionally use middleware to dynamically control access to your search results based on subscription levels.

Example middleware registration:

```typescript
// config/middlewares.ts
export default [
  // ... other middlewares
  {
    name: 'global::easy-search-filter',
    config: { enabled: true },
  },
];
```

---

## 📄 Acknowledgement & Inspiration

- This plugin was inspired by [strapi-plugin-fuzzy-search](https://market.strapi.io/plugins/strapi-plugin-fuzzy-search).
- It began as a weekend project when we realized we needed additional functionality, such as transliteration support and more granular control over data manipulation.

---

## ✅ TODO

- [ ] **Localization** support
- [ ] **Refactor schema generation** for REST API responses
- [ ] Improve dynamic and granular field population for REST API
- [ ] Add tests for both REST and GraphQL endpoints
- [ ] Optimize performance for large data sets

---

## 📝 Contributions

Contributions are welcome. Please create pull requests to address issues or enhance features.

---

## 📜 License

MIT License (Feel free to adjust as needed).
