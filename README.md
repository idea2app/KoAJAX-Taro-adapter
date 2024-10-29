# KoAJAX Taro adapter

A [KoAJAX][1] adapter for mini-app HTTP requests.

[![NPM Dependency](https://img.shields.io/librariesio/github/idea2app/KoAJAX-Taro-adapter.svg)][2]
[![CI & CD](https://github.com/idea2app/KoAJAX-Taro-adapter/actions/workflows/main.yml/badge.svg)][3]
[![](https://data.jsdelivr.com/v1/package/npm/koajax-taro-adapter/badge?style=rounded)][4]

[![NPM](https://nodei.co/npm/koajax-taro-adapter.png?downloads=true&downloadRank=true&stars=true)][5]

## Usage

### Installation

```shell
npm i koajax koajax-taro-adapter
```

### Initialization

```javascript
import { HTTPClient } from 'koajax';
import { request } from 'koajax-taro-adapter';

export const client = new HTTPClient({ baseRequest: request });
```

## User cases

1. Scaffold: https://github.com/idea2app/Taro-Vant-MobX-ts

[1]: https://github.com/EasyWebApp/KoAJAX
[2]: https://libraries.io/npm/koajax-taro-adapter
[3]: https://github.com/idea2app/KoAJAX-Taro-adapter/actions/workflows/main.yml
[4]: https://www.jsdelivr.com/package/npm/koajax-taro-adapter
[5]: https://nodei.co/npm/koajax-taro-adapter/
