# README

코인 단위 변환기


## About

암호화폐의 소수 자릿수를 쉽게 상호변환하는 도구


## Screenshots

### ubuntu 22.04 amd64

![coinunits ubuntu-amd64](https://github.com/tinywolf3/coinunits/assets/7299147/c303a6c6-0bba-49be-8865-27bfe7fc019f)

### windows 11 amd64

![coinunits windows-amd64](https://github.com/tinywolf3/coinunits/assets/7299147/8c2a67c7-e980-4c88-ab64-8f0b76da6901)

### macbook air m1

![coinunits macos-m1](https://github.com/tinywolf3/coinunits/assets/7299147/56a29798-34bf-4b9b-a980-a071adadddf1)


## Building

from Wails Vanilla template.

https://wails.io/ko/

To build a redistributable, production mode package, use `wails build`.

## Packaging

### ubuntu amd64

```bash
wails build
cd packages
mkdir -p coinunits.ubuntu-amd64/usr/local/bin/
cp ../build/bin/coinunits ./coinunits.ubuntu-amd64/usr/local/bin/
dpkg-deb -b coinunits.ubuntu-amd64
```

for install

```bash
sudo apt install ./coinunits.ubuntu-amd64.deb
```

uninstall

```bash
sudo apt remove coinunits   
```

### macos m1

```bash
wails build
gon -log-level=info ./build/darwin/gon-sign.json
cd packages
cp ../build/bin/coinunits.app ./coinunits.macos/코인\ 단위\ 변환기.app
```

./packages/coinunits.macos 폴더를 맥의 디스크 유틸리티를 사용해서 dmg로 패키징 해주면 됨.

이 작업 이후에 'wails dev'는 코드 서명 문제로 작동하지 않을 수 있음.
