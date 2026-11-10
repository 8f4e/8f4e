#ifndef DAISY_WAMR_PLATFORM_INTERNAL_H
#define DAISY_WAMR_PLATFORM_INTERNAL_H

#include <assert.h>
#include <ctype.h>
#include <errno.h>
#include <inttypes.h>
#include <limits.h>
#include <math.h>
#include <stdbool.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* WAMR runs on one execution context. Guest threads are disabled. */
typedef int korp_mutex;
typedef int korp_tid;
typedef int korp_thread;
typedef int korp_cond;
typedef int korp_rwlock;
typedef int korp_sem;
typedef int os_file_handle;
typedef int os_raw_file_handle;
typedef void *os_dir_stream;

#define BH_APPLET_PRESERVED_STACK_SIZE (2 * 1024)
#define BH_THREAD_DEFAULT_PRIORITY 0

static inline os_file_handle os_get_invalid_handle(void) { return -1; }
static inline int os_getpagesize(void) { return 4096; }

#endif
