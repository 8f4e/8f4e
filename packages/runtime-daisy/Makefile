TARGET = 8f4e-field
CPP_SOURCES = src/field.cpp src/wamr-platform.cpp
APP_TYPE = BOOT_QSPI
USE_FATFS = 1
LIBDAISY_DIR ?= $(CURDIR)/third_party/libdaisy
WAMR_DIR ?= $(CURDIR)/third_party/wamr

ifeq ($(wildcard $(LIBDAISY_DIR)/core/Makefile),)
$(error Initialize the Daisy submodules or set LIBDAISY_DIR to the libDaisy source directory)
endif

WAMR_ARCHIVE = dist/wamr/libvmlib.a
C_INCLUDES += -Isrc -I$(WAMR_DIR)/core/iwasm/include -I$(WAMR_DIR)/core/shared/platform/include
LIBS += $(WAMR_ARCHIVE)
SYSTEM_FILES_DIR = $(LIBDAISY_DIR)/core
include $(SYSTEM_FILES_DIR)/Makefile

$(BUILD_DIR)/$(TARGET).elf: $(WAMR_ARCHIVE) build-libdaisy

.PHONY: build-libdaisy
build-libdaisy:
	$(MAKE) -C "$(LIBDAISY_DIR)" BUILD_DIR=build TARGET=libdaisy
