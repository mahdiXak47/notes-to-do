# regex: 

for testing and working with regex you can visit [regex101](https://regex101.com/) 

مدل match کردن regex به شکل greedy عه. یعنی سعی می‌کنه همیشه بزرگ‌ترین متن رو match کنه. 

## grep 

most usefull flags: 
- -r recursive search
- -l list the files that contained the searched regex
- -i search without chech characters sensetiveness
- -v reversed search
- -n show result line numbers
- -c number of matches 

### other grep commands:
- grep -E -> egrep -> for extended regex 
- grep -F -> fgrep -> use the regex file as searched character(example: finding hello$)
- sed -r "s/(Z|R|J)/starts with ZRJ/" friends.txt 
	- -r : use the string as regex

## editor (vim)
### modes:
- insert mode i
- command mode esc
- replace char mode r
- search mode / 

### interesting tricks:
- diw : delete the word you are into 
- diW : delete the hole section until see whitespace

### nvim: 
- space+t+h : themes
- control+n : file browser
	- r rename file
	- c copy file 
	- p paste file
	- a create file
	- m mark a file
- space+f+f: search in files 
- space+f+b: search in opened tabs
- space+c+h: open cheat sheet
- space+x: closing the opened tabs
- tab and shift+tab : switching between tabs
- space+h and space+v : open horizontal and vertical terminal 

## partitioning 

### block devices
lsblk - showing all the block devices 
### fdisk and gdisk 
for creating partitions in block devices
توی سیستم‌های BIOS با fdisk پارتیشن می‌سازن

توی سیستم‌های UFEI با gdisk پارتیشن می‌سازن. بجای MBR هم GPT داریم.

GPT: GUID partition table
MBR: master boot record

### parted: 
پیچیده‌تر اما دارای قابلیت resize

یه gparted هم وجود داره که حالت گرافیکی partedعه
## filesystems: 
- exts(ext2, ext3, ext4)
- swap
- XFS
- VFAT یا FAT32 
- exFAT 
- btrfs

how to create filesystem for partitions: --> mkfs -> make file system command


## RAID?