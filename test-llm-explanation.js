// test-llm-explanation.js - Test the LLM approach with sample data

const { createExplanationPrompt } = require('./explanation-llm.js');

// Your sample data
const sampleSearchHit = {
  "_shard": "[enterprise_products_cohere_embed_english_v3_delta_v9][0]",
  "_node": "4uqg2VESQQKZulzkTSjFYQ",
  "_index": "enterprise_products_cohere_embed_english_v3_delta_v9",
  "_id": "sfcvideo~yrnaKYGhEe-L8RKezlgehQ-Tpgdw",
  "_score": 306.80814,
  "_source": {
    "topic": [
      "Computer Science"
    ]
  },
  "_explanation": {
    "value": 306.80814,
    "description": "script score function, computed with script:\"Script{type=inline, lang='painless', idOrCode='\n                                double score = _score * params['pop_weights']['rel_score'];\n                                for (String key : params['pop_factors']) {\n                                    if(!key.equals(\"rel_score\") && !doc[key].empty) {\n\n                                        double currentValue;\n                                        if (doc[key].value instanceof Boolean) {\n                                            currentValue = doc[key].value ? 1.0 : 0.0;\n                                        } else {\n                                            currentValue = Double.parseDouble(doc[key].value.toString());\n                                        }\n                                        score += Math.log(1 + currentValue) * params['pop_weights'][key];\n                                    }\n                                }\n                                score = Math.max(0, score);\n                                \n                                                    \n                                                    double boosted_score = 1.0;\n                                                    if (params.boosted_products.size() > 0\n                                                    && params.boosted_products.contains(doc[\"_id\"].value))\n                                                    {\n                                                    int priority = params.boosted_products.indexOf(doc[\"_id\"].value);\n                                                    priority = params.boosted_products.size() - priority;\n                                                    boosted_score = (priority + 1) * 1000000;\n                                                    }\n                                                    score = boosted_score + score;\n                                                    \n\n                                                    return score;\n                                                    \n                                ', options={}, params={pop_weights={avg_product_rating=20.0, num_product_ratings=12.41, revenue_usd_last28d=2.26, rel_score=5.0, enrollments=20.0}, boosted_products=[s12n~r4SWcmg7QCiIO_ebBFJUHA], pop_factors=[avg_product_rating, enrollments, num_product_ratings, rel_score, revenue_usd_last28d]}}\"",
    "details": [
      {
        "value": 2.9859154,
        "description": "_score: ",
        "details": [
          {
            "value": 2.9859154,
            "description": "sum of:",
            "details": [
              {
                "value": 2.9859154,
                "description": "script score function, computed with script:\"Script{type=inline, lang='painless', idOrCode='params['query_part_weights']['lexical'] * _score', options={}, params={query_part_weights={lexical=0.1, knn=40.56, partner_phrase=12.65, name_phrase=17.49}}}\"",
                "details": [
                  {
                    "value": 29.859154,
                    "description": "_score: ",
                    "details": [
                      {
                        "value": 29.859154,
                        "description": "sum of:",
                        "details": [
                          {
                            "value": 8.867515,
                            "description": "sum of:",
                            "details": [
                              {
                                "value": 8.867515,
                                "description": "weight(topic:science in 13353) [PerFieldSimilarity], result of:",
                                "details": [
                                  {
                                    "value": 8.867515,
                                    "description": "score(freq=1.0), computed as boost * idf * tf from:",
                                    "details": [
                                      {
                                        "value": 22,
                                        "description": "boost",
                                        "details": []
                                      },
                                      {
                                        "value": 0.91542786,
                                        "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                                        "details": [
                                          {
                                            "value": 357684,
                                            "description": "n, number of documents containing term",
                                            "details": []
                                          },
                                          {
                                            "value": 893439,
                                            "description": "N, total number of documents with field",
                                            "details": []
                                          }
                                        ]
                                      },
                                      {
                                        "value": 0.44030648,
                                        "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                                        "details": [
                                          {
                                            "value": 1,
                                            "description": "freq, occurrences of term within document",
                                            "details": []
                                          },
                                          {
                                            "value": 1.2,
                                            "description": "k1, term saturation parameter",
                                            "details": []
                                          },
                                          {
                                            "value": 0.75,
                                            "description": "b, length normalization parameter",
                                            "details": []
                                          },
                                          {
                                            "value": 2,
                                            "description": "dl, length of field",
                                            "details": []
                                          },
                                          {
                                            "value": 1.8534819,
                                            "description": "avgdl, average length of field",
                                            "details": []
                                          }
                                        ]
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          },
                          {
                            "value": 20.991638,
                            "description": "sum of:",
                            "details": [
                              {
                                "value": 20.991638,
                                "description": "weight(partners:science in 13353) [PerFieldSimilarity], result of:",
                                "details": [
                                  {
                                    "value": 20.991638,
                                    "description": "score(freq=1.0), computed as boost * idf * tf from:",
                                    "details": [
                                      {
                                        "value": 22,
                                        "description": "boost",
                                        "details": []
                                      },
                                      {
                                        "value": 4.0504723,
                                        "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                                        "details": [
                                          {
                                            "value": 15558,
                                            "description": "n, number of documents containing term",
                                            "details": []
                                          },
                                          {
                                            "value": 893439,
                                            "description": "N, total number of documents with field",
                                            "details": []
                                          }
                                        ]
                                      },
                                      {
                                        "value": 0.23556888,
                                        "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                                        "details": [
                                          {
                                            "value": 1,
                                            "description": "freq, occurrences of term within document",
                                            "details": []
                                          },
                                          {
                                            "value": 1.2,
                                            "description": "k1, term saturation parameter",
                                            "details": []
                                          },
                                          {
                                            "value": 0.75,
                                            "description": "b, length normalization parameter",
                                            "details": []
                                          },
                                          {
                                            "value": 10,
                                            "description": "dl, length of field",
                                            "details": []
                                          },
                                          {
                                            "value": 3.0559826,
                                            "description": "avgdl, average length of field",
                                            "details": []
                                          }
                                        ]
                                      }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

// Generate the LLM prompt
const prompt = createExplanationPrompt(sampleSearchHit);
console.log(prompt); 