package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx         context.Context
	readyToQuit bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.readyToQuit = false
}

func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	if a.readyToQuit {
		return false
	}
	runtime.EventsEmit(ctx, "onBeforeClose")
	return true
}

const defconf = `
{
  "symbol": "XPLA",
  "decimals": 18,
  "amount": "0"
}
`

func (a *App) LoadConf() string {
	dirname, err := os.UserHomeDir()
	if err != nil {
		log.Println(err)
		return defconf
	}
	dat, err := os.ReadFile(filepath.Join(dirname, ".coinunits.json"))
	if err != nil {
		log.Println(err)
		a.SaveConf(defconf)
		return defconf
	}
	return string(dat)
}

func (a *App) SaveConf(conf string) {
	dirname, err := os.UserHomeDir()
	if err != nil {
		log.Println(err)
		return
	}
	file, err := os.Create(filepath.Join(dirname, ".coinunits.json"))
	if err != nil {
		log.Println(err)
		return
	}
	defer file.Close()
	fmt.Fprint(file, conf)
}

func (a *App) AppClose() {
	a.readyToQuit = true
	runtime.Quit(a.ctx)
}
