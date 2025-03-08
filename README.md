# **EasySearch - Strapi Plugin**

A Strapi v5 plugin providing **transliterated fuzzy search**, **dynamic population**, and **advanced filtering** for both **GraphQL** and **REST APIs**.

> **✅ Compatible with Strapi v5.10.3 and above**

![Strapi Version](https://img.shields.io/badge/Strapi-v5.10.3+-purple?style=flat-square)  
![License](https://img.shields.io/github/license/codeberryinc/strapi-tagger?style=flat-square) ![NPM Version](https://img.shields.io/npm/v/@codeberry/easysearch?style=flat-square)

----------

## 🚀 Features

-   **Transliterated fuzzy search**: Supports searches in multiple languages.
-   **Subscription-based filtering**: Controls access to content based on user roles or subscription levels.
-   **Advanced population handling**: Dynamically populates nested relations and media fields.
-   **Search in JSON fields**: Extracts and indexes text from rich text blocks.
-   **Supports both REST and GraphQL APIs.**
-   **Highly configurable** via Strapi config.

----------

## ⚙️ Installation

```bash
npm install @codeberry/easysearch

```

or using yarn:

```bash
yarn add @codeberry/easysearch

```

----------

## ⚙️ Configuration

Define your **search settings** inside `config/plugins.ts` or `config/plugins.js`:

```typescript
export default ({ env }) => ({
  'easy-search': {
    enabled: true,
    resolve: "./src/plugins/easy-search",
    config: {
      contentTypes: [
        {
          uid: "api::article.article",
          transliterate: false,
          fuzzysortOptions: {
            characterLimit: 500,
            threshold: -100,
            limit: 10,
            keys: [
              { name: "title", weight: 0.1 },
              { name: "content", weight: 2 }, // Enables rich-text content search
            ],
          },
        },
        {
          uid: "api::offer.offer",
          transliterate: false,
          fuzzysortOptions: {
            characterLimit: 500,
            threshold: 0.5,
            limit: 10,
            keys: [
              { name: "title", weight: 0.2 },
              { name: "content", weight: -0.2 },
            ],
          },
        },
      ],
    },
  },
});

```

### Explanation:

-   `transliterate: false` → Disables transliteration (set `true` if needed).
-   `fuzzysortOptions.characterLimit` → Trims searchable fields to improve performance.
-   `threshold` → Defines how strict the matching is.
-   `limit` → Controls the number of results returned.
-   `keys` → Specifies which fields are indexed for search, along with their **weighting**.

----------

## 🎯 Usage

### **REST API**

**Example request:**

```http
GET /api/easy-search/search?query=example&page=1&pageSize=10&populate=featuredMedia,image

```

#### **Supported Query Parameters:**

-   `query` → The search term.
-   `fields` → Comma-separated list of fields to return.
-   `populate` → Dynamically populate nested relations.
-   `page` & `pageSize` → Handles pagination.

### **Example REST API Call**

```sh
GET http://localhost:1337/api/easy-search/search?query=example&page=1&pageSize=10&fields=title,excerpt,slug&populate=featuredMedia.image

```

#### **Example Response**

```json
{
  "data": {
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

----------

### **GraphQL API**

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

----------

## ⚙️ Middleware (Optional)

EasySearch supports **custom middleware** for **filtering content** dynamically.  
For example, **restricting content access based on user roles**.

### **Example Middleware Registration**

```typescript
// config/middlewares.ts
export default [
  // ... other middlewares
  "global::easy-search-filter"
];
```

----------

## 📄 Changelog

### **Latest Updates**

-   **New Plugin Configuration:** Introduced `fuzzysortOptions` for advanced search tuning.
-   **Dynamic Population:** Now supports nested fields for REST API.
-   **Improved JSON Search Support:** Rich text blocks now properly indexed.
-   **Strapi 5 Compatibility:** Removed deprecated `entityService`, using new `strapi.db.query`.

----------

## ✅ TODO

-   **Localization Support** → Improve multilingual search capabilities.
-   **Refactor Schema Generation** → Improve REST API response structure.
-   **GraphQL Performance Optimization** → Reduce unnecessary computations.
-   **Unit Testing** → Add tests for both REST & GraphQL endpoints.
-   **Optimize Search Indexing** → Improve efficiency on large datasets.

----------

## 📝 Contributions

Contributions are welcome! If you find a bug or have an idea for improvement, feel free to **open an issue or submit a pull request**.

----------

## 📜 License

This project is licensed under the **MIT License**.
